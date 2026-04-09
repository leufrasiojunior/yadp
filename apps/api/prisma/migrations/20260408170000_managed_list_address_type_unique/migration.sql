DROP INDEX IF EXISTS "ManagedList_address_key";

CREATE UNIQUE INDEX "ManagedList_address_type_key" ON "ManagedList"("address", "type");
