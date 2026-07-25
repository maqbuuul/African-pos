DROP INDEX "customer_identities_type_value_key";--> statement-breakpoint
DROP INDEX "gift_cards_code_key";--> statement-breakpoint
CREATE UNIQUE INDEX "customer_identities_org_type_value_key" ON "customer_identities" USING btree ("organization_id","identity_type","identity_value");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_cards_org_code_key" ON "gift_cards" USING btree ("organization_id","code");