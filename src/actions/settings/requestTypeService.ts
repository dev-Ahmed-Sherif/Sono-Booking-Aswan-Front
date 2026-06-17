"use server";

import axios from "@/lib/axios-auth";

type Payload = Record<string, unknown>;
const BASE = "RequestTypes";

async function request(method: "get" | "post" | "put" | "delete", url: string, data?: unknown) {
  const config = {
    headers: {
      "Content-Type": "application/json",
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

const getRequestTypes = async () => request("get", `${process.env.BACK_END}/${BASE}/getAll`);
const getRequestTypeById = async (id: string) =>
  id === "new" ? undefined : request("get", `${process.env.BACK_END}/${BASE}/get/${id}`);
const getRequestTypesPaged = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getPaged`, filter);
const getRequestTypesDropDown = async (filter: Payload) => request("post", `${process.env.BACK_END}/${BASE}/getDropDown`, filter);
const addRequestType = async (data: Payload) => request("post", `${process.env.BACK_END}/${BASE}/add`, data);
const updateRequestTypeById = async (data: Payload) => request("put", `${process.env.BACK_END}/${BASE}/update`, data);
const deleteRequestTypeById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/delete/${id}`);
const softDeleteRequestTypeById = async (id: string) => request("delete", `${process.env.BACK_END}/${BASE}/deleteSoft/${id}`);

export {
  addRequestType,
  deleteRequestTypeById,
  getRequestTypeById,
  getRequestTypes,
  getRequestTypesDropDown,
  getRequestTypesPaged,
  softDeleteRequestTypeById,
  updateRequestTypeById,
};
