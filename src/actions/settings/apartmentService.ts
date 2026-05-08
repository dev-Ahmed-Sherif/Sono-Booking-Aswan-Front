"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;

const BASE = "Apartments";

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  const config = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      withCredentials: true,
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
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return {
      error: "Request Failed",
      message: err.response?.data?.message || err.message || "An unexpected error occurred",
    };
  }
}

const getApartments = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getApartmentById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getApartmentsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getApartmentsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addApartment = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateApartmentById = async (data: Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteApartmentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteApartmentById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addApartment,
  deleteApartmentById,
  getApartmentById,
  getApartments,
  getApartmentsDropDown,
  getApartmentsPaged,
  softDeleteApartmentById,
  updateApartmentById,
};
