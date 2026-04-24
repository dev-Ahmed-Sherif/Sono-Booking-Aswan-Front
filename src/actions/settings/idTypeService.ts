"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const getIdTypes = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/idtypes/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    console.error("Error getting id types:", error);

    const err = error as {
      response?: { status?: number; data?: { message?: string } };
      message?: string;
    };
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get id types",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export { getIdTypes };
