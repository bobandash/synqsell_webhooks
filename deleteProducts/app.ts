import { APIGatewayProxyResult } from 'aws-lambda';
import aws from 'aws-sdk';
import { Client } from 'pg';
import { composeGid } from '@shopify/admin-graphql-api-utilities';
/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */

type ProductDeletePayload = {
    id: string;
};

const secretManagerClient = new aws.SecretsManager();

export const lambdaHandler = async (event: ProductDeletePayload): Promise<APIGatewayProxyResult> => {
    let client: Client | null = null;
    try {
        const secretManagerResult = await secretManagerClient
            .getSecretValue({
                SecretId: process.env.SECRET_MANAGER_ID ?? '',
            })
            .promise();
        const cred = JSON.parse(secretManagerResult.SecretString as string);
        const { user, password, host, port, database } = cred;
        client = new Client({
            user,
            password,
            host,
            port,
            database,
        });
        await client.connect();
        const { id } = event;
        const shopifyDeletedProductId = composeGid('Product', id);
        const deleteProductQuery = 'DELETE FROM "Product" WHERE shopifyProductId = $1';
        await client.query(deleteProductQuery, [shopifyDeletedProductId]);
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Successfully deleted products from database',
            }),
        };
    } catch {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Could not delete products',
            }),
        };
    } finally {
        if (client) {
            await client.end();
        }
    }
};

// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

// import {
//     SecretsManagerClient,
//     GetSecretValueCommand,
//   } from "@aws-sdk/client-secrets-manager";

//   const secret_name = "rds-db-credentials/synqsell-db-dev/postgres/1726084554591";

//   const client = new SecretsManagerClient({
//     region: "us-east-2",
//   });

//   let response;

//   try {
//     response = await client.send(
//       new GetSecretValueCommand({
//         SecretId: secret_name,
//         VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
//       })
//     );
//   } catch (error) {
//     // For a list of exceptions thrown, see
//     // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
//     throw error;
//   }

//   const secret = response.SecretString;

//   // Your code goes here
