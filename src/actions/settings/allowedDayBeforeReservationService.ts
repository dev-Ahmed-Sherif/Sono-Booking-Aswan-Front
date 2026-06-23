"use server";

import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";

type Payload = Record<string, unknown>;
const BASE = "AllowedDayBeforeReservations";

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const accessToken = await getAccessToken();
  const config = {
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
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

const getAllowedDayBeforeReservations = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getAllowedDayBeforeReservationById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getAllowedDayBeforeReservationsPaged = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getAllowedDayBeforeReservationsDropDown = async (filter: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addAllowedDayBeforeReservation = async (data: Payload) =>
  request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateAllowedDayBeforeReservationById = async (data: Payload) =>
  request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteAllowedDayBeforeReservationById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteAllowedDayBeforeReservationById = async (id: string) =>
  request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addAllowedDayBeforeReservation,
  deleteAllowedDayBeforeReservationById,
  getAllowedDayBeforeReservationById,
  getAllowedDayBeforeReservations,
  getAllowedDayBeforeReservationsDropDown,
  getAllowedDayBeforeReservationsPaged,
  softDeleteAllowedDayBeforeReservationById,
  updateAllowedDayBeforeReservationById,
};
