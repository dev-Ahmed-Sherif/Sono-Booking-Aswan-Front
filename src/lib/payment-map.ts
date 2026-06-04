/**
 * Mirrors `SonoBooking.Domain.PaymentStatus`.
 * API uses `StringEnumConverter` — values are `"Pending"`, `"Paid"`, etc.
 */
export type PaymentStatus = 1 | 2 | 3 | 4;

export const PAYMENT_STATUS_PENDING = 1 as const satisfies PaymentStatus;
export const PAYMENT_STATUS_PAID = 2 as const satisfies PaymentStatus;
export const PAYMENT_STATUS_FAILED = 3 as const satisfies PaymentStatus;
export const PAYMENT_STATUS_REFUNDED = 4 as const satisfies PaymentStatus;

/**
 * Mirrors `SonoBooking.Domain.PaymentMethod`.
 */
export type PaymentMethod = 1 | 2 | 3;

export const PAYMENT_METHOD_CASH = 1 as const satisfies PaymentMethod;
export const PAYMENT_METHOD_CARD = 2 as const satisfies PaymentMethod;
export const PAYMENT_METHOD_BANK_TRANSFER = 3 as const satisfies PaymentMethod;

export function paymentStatusToApiName(
  status: PaymentStatus,
): "Pending" | "Paid" | "Failed" | "Refunded" {
  switch (status) {
    case PAYMENT_STATUS_PAID:
      return "Paid";
    case PAYMENT_STATUS_FAILED:
      return "Failed";
    case PAYMENT_STATUS_REFUNDED:
      return "Refunded";
    default:
      return "Pending";
  }
}

export function paymentMethodToApiName(
  method: PaymentMethod,
): "Cash" | "Card" | "Transfer" {
  switch (method) {
    case PAYMENT_METHOD_CARD:
      return "Card";
    case PAYMENT_METHOD_BANK_TRANSFER:
      return "Transfer";
    default:
      return "Cash";
  }
}

/** Mirrors `SonoBooking.Common.DTO.Housing.Payment.AddPaymentDto`. */
export type AddPaymentDtoPayload = {
  id?: string;
  amount: number;
  paymentMethod: PaymentMethod | string;
  paymentStatus: PaymentStatus | string;
  paymentDate: string;
  transactionReference?: string;
  reservationId: string;
};

/** Mirrors `SonoBooking.Common.DTO.Housing.Payment.PaymentDto`. */
export type PaymentDtoPayload = AddPaymentDtoPayload & {
  code?: string;
  createdAt?: string;
  createdById?: string;
  createdBy?: string;
  modifiedAt?: string;
  modifiedById?: string;
  modifiedBy?: string;
  isDeleted?: boolean;
};

/** Serializes `AddPaymentDto` for `Payments/add` and `Payments/update`. */
export function serializeAddPaymentDtoForApi(
  payload: AddPaymentDtoPayload,
): Record<string, unknown> {
  const paymentMethod =
    typeof payload.paymentMethod === "string"
      ? payload.paymentMethod
      : paymentMethodToApiName(payload.paymentMethod);
  const paymentStatus =
    typeof payload.paymentStatus === "string"
      ? payload.paymentStatus
      : paymentStatusToApiName(payload.paymentStatus);

  const body: Record<string, unknown> = {
    amount: payload.amount,
    paymentMethod,
    paymentStatus,
    paymentDate: payload.paymentDate,
    transactionReference: payload.transactionReference?.trim() ?? "",
    reservationId: payload.reservationId.trim(),
  };

  const id = payload.id?.trim();
  if (id) body.id = id;

  return body;
}

/** Mirrors `BaseParam<PaymentFilter>` for `Payments/getPaged`. */
export type PaymentPagedFilterPayload = {
  pageNumber: number;
  pageSize: number;
  filter?: {
    isDeleted?: boolean;
  };
  orderByValue?: Array<{
    colId?: string;
    sort?: string;
  }>;
};
