"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import postgres from "postgres";
import { z } from "zod";

const sql = postgres(process.env.POSTGRES_URL!, { ssl: "require" });

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: "Please select a customer.",
  }),
  amount: z.coerce
    .number()
    .gt(0, { message: "Please enter an amount greater than $0." }),
  status: z.enum(["pending", "paid"], {
    invalid_type_error: "Please select an invoice status.",
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

export type State = {
  data?: {
    customerId: FormDataEntryValue | null;
    amount: FormDataEntryValue | null;
    status: FormDataEntryValue | null;
  };
  errors?: z.inferFlattenedErrors<typeof CreateInvoice>["fieldErrors"];
  message?: string | null;
};

export async function createInvoice(
  prevState: State,
  formData: FormData
): Promise<State> {
  // Validate form using Zod
  const oldFormData = {
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  };
  const validatedFields = CreateInvoice.safeParse(oldFormData);

  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      data: oldFormData,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Create Invoice.",
    };
  }

  // Prepare data for insertion into the database
  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;
  const date = new Date().toISOString().split("T")[0];

  // Insert data into the database
  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
  } catch (error) {
    // If a database error occurs, return a more specific error.
    console.error(error);
    return {
      data: oldFormData,
      message: "Database Error: Failed to Create Invoice.",
    };
  }

  // Revalidate the cache for the invoices page and redirect the user.
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  prevState: State,
  formData: FormData
): Promise<State> {
  const oldFormData = {
    customerId: formData.get("customerId"),
    amount: formData.get("amount"),
    status: formData.get("status"),
  };
  const validatedFields = UpdateInvoice.safeParse(oldFormData);

  if (!validatedFields.success) {
    return {
      data: oldFormData,
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Missing Fields. Failed to Update Invoice.",
    };
  }

  const { customerId, amount, status } = validatedFields.data;
  const amountInCents = amount * 100;

  try {
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
  } catch (error) {
    console.error(error);

    return {
      data: oldFormData,
      message: "Database Error: Failed to Update Invoice.",
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string) {
  // throw new Error("Failed to Delete Invoice");

  await sql`DELETE FROM invoices WHERE id = ${id}`;
  revalidatePath("/dashboard/invoices");
}

export async function authenticate(
  prevState: { formData: FormData; message: string | undefined } | undefined,
  formData: FormData
) {
  try {
    await signIn("credentials", formData);
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case "CredentialsSignin":
          return { formData, message: "Invalid credentials." };
        default:
          return { formData, message: "Something went wrong." };
      }
    }
    throw error;
  }
}
