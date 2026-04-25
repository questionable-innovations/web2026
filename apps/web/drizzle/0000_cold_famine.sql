CREATE TABLE `attestations` (
	`id` text PRIMARY KEY NOT NULL,
	`contract_id` text NOT NULL,
	`wallet` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`attestation_hash` text NOT NULL,
	`signed_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`escrow_address` text,
	`title` text NOT NULL,
	`pdf_cid` text NOT NULL,
	`pdf_hash` text NOT NULL,
	`party_a_wallet` text NOT NULL,
	`party_b_wallet` text,
	`deposit_token` text NOT NULL,
	`deposit_amount` text NOT NULL,
	`fields_json` text DEFAULT '[]' NOT NULL,
	`state` text DEFAULT 'Draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `email_otps` (
	`email` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL
);
