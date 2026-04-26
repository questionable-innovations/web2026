import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import pdfParse from "pdf-parse";
import { isPositiveDecimalInput, sanitizeDecimalInput } from "@/lib/input";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response("No file provided", { status: 400 });
    }

    // Convert file to buffer for pdf-parse
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from the PDF
    const pdfData = await pdfParse(buffer);
    const pdfText = pdfData.text;

    // Use AI to extract structured info based on the PDF text
    // Using gpt-4o-mini as it's fast and highly capable for this task
    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        title: z
          .string()
          .optional()
          .describe(
            "A short descriptive title for the contract (e.g. Services Agreement x Company). Leave blank or omit if not found."
          ),
        counterpartyName: z
          .string()
          .optional()
          .describe("The name of the counterparty, client, or contractor. Leave blank or omit if not found."),
        counterpartyEmail: z
          .string()
          .optional()
          .describe("The email address of the counterparty, if available. Leave blank or omit if not found."),
        amount: z
          .string()
          .optional()
          .describe(
            "The deposit amount or upfront payment mentioned in the contract (numeric string only, e.g. 5000). Leave blank or omit if not found."
          ),
        totalDue: z
          .string()
          .optional()
          .describe(
            "The total due or total billing amount mentioned in the contract (numeric string only, e.g. 10000). Leave blank or omit if not found."
          ),
        daysUntilDeadline: z
          .number()
          .optional()
          .describe(
            "The number of days until the deal deadline or expiration, if explicitly stated (e.g. 30, 21, 60). Leave blank or omit if not found."
          ),
      }),
      prompt: `Analyze the following contract document text and extract the key details defined by the schema. If a piece of information is completely missing from the text, omit the field entirely or return an empty string. Do not invent information.\n\nDocument Text:\n${pdfText}`,
    });

    const amount = object.amount
      ? sanitizeDecimalInput(String(object.amount))
      : undefined;
    const totalDue = object.totalDue
      ? sanitizeDecimalInput(String(object.totalDue))
      : undefined;

    return Response.json({
      ...object,
      amount: amount && isPositiveDecimalInput(amount) ? amount : undefined,
      totalDue:
        totalDue && isPositiveDecimalInput(totalDue) ? totalDue : undefined,
      daysUntilDeadline:
        object.daysUntilDeadline && object.daysUntilDeadline > 0
          ? Math.floor(object.daysUntilDeadline)
          : undefined,
    });
  } catch (error: unknown) {
    console.error("PDF Extraction error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
    });
  }
}
