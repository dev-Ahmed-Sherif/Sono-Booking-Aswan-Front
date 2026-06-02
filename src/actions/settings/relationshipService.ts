"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";

type Payload = Record<string, unknown>;
const BASE = "Relationships";

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const config = {
    headers,
    withCredentials: true,
  };

  try {
    if (method === "get" || method === "delete")
      return toPlainSerializable((await axios[method](url, config)).data);
    return toPlainSerializable((await axios[method](url, data, config)).data);
  } catch (error: unknown) {
    const err = error as { response?: { data?: { message?: string } }; message?: string };
    return { error: "Request Failed", message: err.response?.data?.message || err.message || "An unexpected error occurred" };
  }
}

const getRelationships = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getRelationshipById = async (id: string) =>
  id === "new" ? null : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getRelationshipsPaged = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getRelationshipsDropDown = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addRelationship = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateRelationshipById = async (data: Payload) => request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteRelationshipById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteRelationshipById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addRelationship,
  deleteRelationshipById,
  getRelationshipById,
  getRelationships,
  getRelationshipsDropDown,
  getRelationshipsPaged,
  softDeleteRelationshipById,
  updateRelationshipById,
};
