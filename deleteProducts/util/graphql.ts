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

    try {
        console.log(`Attempting to fetch from ${url}`);
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({ query: mutation, variables }),
        });

        if (!response.ok) {
            console.error(`HTTP error! status: ${response.status}`);
            console.error(`Response text: ${await response.text()}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();
        console.log('Response received:', JSON.stringify(responseData, null, 2));

        if (!responseData.data) {
            console.error('No data in response:', responseData);
            throw new Error(defaultErrorMessage);
        }

        const mutationName = Object.keys(responseData.data)[0];
        const mutationData = responseData.data[mutationName];

        if (mutationData.userErrors && mutationData.userErrors.length > 0) {
            const errorMessages = mutationData.userErrors.map((error: any) => error.message).join(' ');
            console.error('User errors:', errorMessages);
            throw new Error(errorMessages);
        }

        return responseData.data as T;
    } catch (error) {
        console.error('Error in mutateAndValidateGraphQLData:', error);
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        throw error;
    }
}

// async function mutateAndValidateGraphQLData<T>(
//     shop: string,
//     accessToken: string,
//     mutation: string,
//     variables: any,
//     defaultErrorMessage: string,
// ): Promise<T> {
//     const url = `https://${shop}/admin/api/2024-07/graphql.json`;
//     const response = await fetch(url, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json',
//             'X-Shopify-Access-Token': accessToken,
//         },
//         body: JSON.stringify({ query: mutation, variables }),
//     });
//     const { data } = await response.json();
//     if (!data) {
//         throw new Error(defaultErrorMessage);
//     }
//     const mutationName = Object.keys(data)[0];
//     const mutationData = data[mutationName];
//     if (mutationData.userErrors && mutationData.userErrors.length > 0) {
//         throw new Error(mutationData.userErrors.map((error: any) => error.message).join(' '));
//     }
//     return data as T;
// }

export { fetchAndValidateGraphQLData, mutateAndValidateGraphQLData };
