import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const contracts = sqliteTable("contracts", {
  id: text("id").primaryKey(),
  escrowAddress: text("escrow_address"),
  title: text("title").notNull(),
  pdfCid: text("pdf_cid").notNull(),
  pdfHash: text("pdf_hash").notNull(),
  signedPdfCid: text("signed_pdf_cid"),
  partyAWallet: text("party_a_wallet").notNull(),
  partyBWallet: text("party_b_wallet"),
  depositToken: text("deposit_token").notNull(),
  depositAmount: text("deposit_amount").notNull(),
  fieldsJson: text("fields_json").notNull().default("[]"),
  state: text("state").notNull().default("Draft"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const attestations = sqliteTable("attestations", {
  id: text("id").primaryKey(),
  contractId: text("contract_id")
    .notNull()
    .references(() => contracts.id),
  wallet: text("wallet").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  attestationHash: text("attestation_hash").notNull(),
  signedAt: integer("signed_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const emailOtps = sqliteTable("email_otps", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
});
