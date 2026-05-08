"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;
const BASE = "Cities";

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

const getCities = async (governorateId?: string) => {
  const query = governorateId ? `?governorateId=${encodeURIComponent(governorateId)}` : "";
  return request("get", `${process.env.BACK_END}/${BASE}/getAll${query}`);
};
const getCityById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getCitiesPaged = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getCitiesDropDown = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addCity = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateCityById = async (data: Payload) => request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteCityById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteCityById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addCity,
  deleteCityById,
  getCities,
  getCitiesDropDown,
  getCitiesPaged,
  getCityById,
  softDeleteCityById,
  updateCityById,
};
