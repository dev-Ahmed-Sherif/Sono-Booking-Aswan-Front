"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;
const BASE = "Governorates";

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const accessToken = await getAccessToken();
  if (!accessToken) return { error: "Unauthorized", message: "No access token found. Please login again." };

  const config = {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      withCredentials: true,
    },
  };

  try {
    if (method === "get" || method === "delete") return (await axios[method](url, config)).data;
    return (await axios[method](url, data, config)).data;
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return { error: "Request Failed", message: err.response?.data?.message || err.message || "An unexpected error occurred" };
  }
}

const getGovernorates = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getGovernorateById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getGovernoratesPaged = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getGovernoratesDropDown = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addGovernorate = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateGovernorateById = async (data: Payload) => request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteGovernorateById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteGovernorateById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addGovernorate,
  deleteGovernorateById,
  getGovernorateById,
  getGovernorates,
  getGovernoratesDropDown,
  getGovernoratesPaged,
  softDeleteGovernorateById,
  updateGovernorateById,
};
