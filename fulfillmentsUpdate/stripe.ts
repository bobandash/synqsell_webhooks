import Stripe from 'stripe';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

type StripSecrets = {
    STRIPE_SECRET_API_KEY: string;
    REACT_APP_STRIPE_PUBLISHABLE_KEY: string;
};

let stripe: Stripe | null = null;
const client = new SecretsManagerClient();

const getStripeSecrets = async () => {
    try {
        const response = await client.send(
            new GetSecretValueCommand({
                SecretId: process.env.STRIPE_SECRET_ARN ?? '',
            }),
        );

        const secretString = response.SecretString;
        if (!secretString) {
            throw new Error('There are no secrets inside secret string.');
        }
        const stripeSecrets = JSON.parse(secretString);
        return stripeSecrets as StripSecrets;
    } catch (error) {
        console.error(error);
        throw new Error('failed to get stripe secrets');
    }
};

export async function getStripe() {
    if (stripe) return stripe;
    const stripeSecrets = await getStripeSecrets();

    stripe = new Stripe(stripeSecrets.STRIPE_SECRET_API_KEY, {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        apiVersion: '2023-10-16',
    });

    return stripe;
}
