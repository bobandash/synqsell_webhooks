export const ORDER_PAYMENT_STATUS = {
    INCOMPLETE: 'INCOMPLETE',
    PARTIALLY_PAID: 'PARTIALLY_PAID',
    PAID: 'PAID',
} as const;

export type OrderPaymentStatusProps = (typeof ORDER_PAYMENT_STATUS)[keyof typeof ORDER_PAYMENT_STATUS];
