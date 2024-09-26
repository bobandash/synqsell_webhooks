/* eslint-disable @typescript-eslint/no-explicit-any */
async function fetchAndValidateGraphQLData<T>(
    shop: string,
    accessToken: string,
    query: string,
    variables: any,
): Promise<T> {
    const url = `https://${shop}/admin/api/2024-07/graphql.json`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query, variables }),
    });
    const { data } = await response.json();
    if (!data) {
        throw new Error('No data returned from GraphQL query');
    }
    return data as T;
}

async function mutateAndValidateGraphQLData<T>(
    shop: string,
    accessToken: string,
    mutation: string,
    variables: any,
    defaultErrorMessage: string,
): Promise<T> {
    const url = `https://${shop}/admin/api/2024-07/graphql.json`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({ query: mutation, variables }),
    });
    const { data } = await response.json();
    if (!data) {
        throw new Error(defaultErrorMessage);
    }
    const mutationName = Object.keys(data)[0];
    const mutationData = data[mutationName];
    if (mutationData.userErrors && mutationData.userErrors.length > 0) {
        throw new Error(mutationData.userErrors.map((error: any) => error.message).join(' '));
    }
    return data as T;
}

export { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData };
