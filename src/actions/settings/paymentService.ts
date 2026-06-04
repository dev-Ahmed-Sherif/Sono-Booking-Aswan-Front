"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import type {
  AddPaymentDtoPayload,
  PaymentPagedFilterPayload,
} from "@/lib/payment-map";

type Payload = Record<string, unknown>;

const BASE = "Payments";

function mapAxiosPaymentError(error: unknown): {
  error: string;
  message: string;
} {
  const err = error as {
    response?: {
      status?: number;
      data?: { message?: string; Message?: string };
    };
    message?: string;
  };

  if (err.response?.status === 401) {
    return {
      error: "Unauthorized",
      message:
        err.response?.data?.message ||
        err.response?.data?.Message ||
        "يرجى تسجيل الدخول مرة أخرى.",
    };
  }

  return {
    error: "Request Failed",
    message:
      err.response?.data?.message ||
      err.response?.data?.Message ||
      err.message ||
      "حدث خطأ غير متوقع",
  };
}

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "لم يتم العثور على جلسة الدخول. يرجى تسجيل الدخول.",
    };
  }

  const config = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    withCredentials: true,
  };

  try {
    if (method === "get" || method === "delete") {
      return toPlainSerializable((await axios[method](url, config)).data);
    }
    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    return mapAxiosPaymentError(error);
  }
}

const getPayments = async () =>
  request("get", `${process.env.BACK_END}/${BASE}/getAll`);

const getPaymentById = async (id: string) =>
  id === "new"
    ? null
    : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);

const getPaymentsPaged = async (filter: PaymentPagedFilterPayload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);

const addPayment = async (data: AddPaymentDtoPayload | Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/add`, data);

const updatePaymentById = async (data: AddPaymentDtoPayload | Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);

const deletePaymentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);

const softDeletePaymentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addPayment,
  deletePaymentById,
  getPaymentById,
  getPayments,
  getPaymentsPaged,
  softDeletePaymentById,
  updatePaymentById,
};
