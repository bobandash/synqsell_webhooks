import { PoolClient } from 'pg';
import createMapIdToRestObj from '../../util/createMapToRestObj';

type VariantAndImportedVariant = {
    retailerShopifyVariantId: string;
    supplierShopifyVariantId: string;
};

async function getRetailerToSupplierVariantIdMap(retailerVariantIds: string[], client: PoolClient) {
    const supplierAndRetailerVariantIdsQuery = `
      SELECT 
          "ImportedVariant"."shopifyVariantId" as "retailerShopifyVariantId",
          "Variant"."shopifyVariantId" as "supplierShopifyVariantId"
      FROM "ImportedVariant"
      INNER JOIN "Variant" ON "ImportedVariant"."prismaVariantId" = "Variant"."id"
      WHERE "ImportedVariant"."shopifyVariantId" = ANY($1)  
    `;
    const baseAndImportedVariantData: VariantAndImportedVariant[] = (
        await client.query(supplierAndRetailerVariantIdsQuery, [retailerVariantIds])
    ).rows;

    const retailerToSupplierVariantIdMap = createMapIdToRestObj(baseAndImportedVariantData, 'retailerShopifyVariantId');
    return retailerToSupplierVariantIdMap;
}

export default getRetailerToSupplierVariantIdMap;
