"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const getGenders = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/Genders/getAll`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    console.error("Error getting genders:", error);

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
      error: "Failed to get genders",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export { getGenders };
