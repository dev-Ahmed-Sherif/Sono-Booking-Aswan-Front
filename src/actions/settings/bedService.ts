"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;

const BASE = "Beds";

function toFormData(payload: Payload): FormData {
  const formData = new FormData();

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item === undefined || item === null) return;
        if (item instanceof File) {
          formData.append(key, item);
        } else {
          formData.append(key, String(item));
        }
      });
      return;
    }

    if (value instanceof File) {
      formData.append(key, value);
      return;
    }

    formData.append(key, String(value));
  });

  return formData;
}

async function request(
  method: "get" | "post" | "put" | "delete",
  url: string,
  data?: unknown,
  extraHeaders?: Record<string, string>,
) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  const isFormData = data instanceof FormData;
  const config = {
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      Authorization: `Bearer ${accessToken}`,
      withCredentials: true,
      ...(extraHeaders ?? {}),
    },
  };

  try {
    if (method === "get" || method === "delete") {
      const res = await axios[method](url, config);
      return res.data;
    }

    const res = await axios[method](url, data, config);
    return res.data;
  } catch (error: unknown) {
    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    return {
      error: "Request Failed",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
}

const getBeds = async (roomId?: string) => {
  const trimmed = roomId?.trim();
  return request(
    "get",
    `${process.env.BACK_END}/${BASE}/getAll`,
    undefined,
    trimmed ? { RoomId: trimmed } : undefined,
  );
};
const getBedById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getBedsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getBedsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addBed = async (data: Payload | FormData) =>
  request(
    "post",
    `${process.env.BACK_END}/${BASE}/add`,
    data instanceof FormData ? data : toFormData(data),
  );
const updateBedById = async (data: Payload | FormData) =>
  request(
    "put",
    `${process.env.BACK_END}/${BASE}/update`,
    data instanceof FormData ? data : toFormData(data),
  );
const deleteBedById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteBedById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addBed,
  deleteBedById,
  getBedById,
  getBeds,
  getBedsDropDown,
  getBedsPaged,
  softDeleteBedById,
  updateBedById,
};
