"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type QueryValue = string | number | boolean | undefined;
type Payload = Record<string, unknown>;

const BASE = "ApartmentTypes";

async function withAuth() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return null;
  }

  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      withCredentials: true,
    },
  };
}

function buildQuery(params: Record<string, QueryValue>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const config = await withAuth();
  if (!config) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  try {
    if (method === "get" || method === "delete") {
      const res = await axios[method](url, config);
      return res.data;
    }

    const res = await axios[method](url, data, config);
    return res.data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return {
      error: "Request Failed",
      message: err.response?.data?.message || err.message || "An unexpected error occurred",
    };
  }
}

const getApartmentTypes = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getApartmentTypeById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getApartmentTypesPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getApartmentTypesDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addApartmentType = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateApartmentTypeById = async (data: Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteApartmentTypeById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteApartmentTypeById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addApartmentType,
  deleteApartmentTypeById,
  getApartmentTypeById,
  getApartmentTypes,
  getApartmentTypesDropDown,
  getApartmentTypesPaged,
  softDeleteApartmentTypeById,
  updateApartmentTypeById,
  buildQuery,
};
