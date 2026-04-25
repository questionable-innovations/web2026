import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import pdfParse from "pdf-parse";

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
          .describe(
            "A short descriptive title for the contract (e.g. Services Agreement x Company)"
          ),
        counterpartyName: z
          .string()
          .describe("The name of the counterparty, client, or contractor"),
        counterpartyEmail: z
          .string()
          .email()
          .optional()
          .describe("The email address of the counterparty, if available"),
        amount: z
          .string()
          .describe(
            "The total amount, deposit, or billing amount mentioned in the contract (numeric string only, e.g. 5000)"
          ),
      }),
      prompt: `Analyze the following contract document text and extract the key details defined by the schema. \n\nDocument Text:\n${pdfText}`,
    });

    return Response.json(object);
  } catch (error: any) {
    console.error("PDF Extraction error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
    });
  }
}
