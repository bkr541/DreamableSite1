-- CreateIndex
CREATE UNIQUE INDEX "services_name_key" ON "services"("name");

-- CreateIndex
CREATE UNIQUE INDEX "service_sub_categories_service_id_name_key" ON "service_sub_categories"("service_id", "name");
