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

export const PAYMENT_METHOD_OPTIONS: Array<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: PAYMENT_METHOD_CASH, label: "نقدي" },
  { value: PAYMENT_METHOD_CARD, label: "بطاقة" },
  { value: PAYMENT_METHOD_BANK_TRANSFER, label: "تحويل بنكي" },
];

export function parsePaymentMethodInput(value: unknown): PaymentMethod | null {
  const n = Number(value);
  if (n === PAYMENT_METHOD_CASH) return PAYMENT_METHOD_CASH;
  if (n === PAYMENT_METHOD_CARD) return PAYMENT_METHOD_CARD;
  if (n === PAYMENT_METHOD_BANK_TRANSFER) return PAYMENT_METHOD_BANK_TRANSFER;
  return null;
}

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

function pickStr(r: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = r[key];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function pickNum(r: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const v = r[key];
    if (v == null || v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Parses `PaymentDto` from API list rows. */
export function parsePaymentFromApi(
  raw: Record<string, unknown>,
): PaymentDtoPayload | null {
  const reservationId = pickStr(raw, "reservationId", "ReservationId");
  if (!reservationId) return null;

  const amount = pickNum(raw, "amount", "Amount");
  if (amount == null || amount < 0) return null;

  return {
    id: pickStr(raw, "id", "Id") || undefined,
    code: pickStr(raw, "code", "Code") || undefined,
    amount,
    paymentMethod:
      pickStr(raw, "paymentMethod", "PaymentMethod") || PAYMENT_METHOD_CASH,
    paymentStatus:
      pickStr(raw, "paymentStatus", "PaymentStatus") || PAYMENT_STATUS_PAID,
    paymentDate: pickStr(raw, "paymentDate", "PaymentDate"),
    transactionReference:
      pickStr(raw, "transactionReference", "TransactionReference") ||
      undefined,
    reservationId,
  };
}
