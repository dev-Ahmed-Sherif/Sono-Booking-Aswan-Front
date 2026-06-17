"use server";

import * as z from "zod";
import axios from "@/lib/axios-auth";
import { getAccessToken } from "@/lib/token-helper";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import { runAccountUpdatePut } from "@/lib/account-update-remote";

function errorMessageFromAxios(data: unknown, fallback: string): string {
  if (typeof data === "string" && data.trim()) return data;
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

const addUser = async (data: any) => {
  try {
    console.log("addUser:", data);
    const {
      name,
      email,
      oldPassword,
      newPassword,
      confirmPassword,
      roleId,
      organizationId,
      technicalJobCategoryId,
    } = data;

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const requestBody: any = {
      userName: name,
      email: email,
      password: newPassword,
      roleId: roleId,
    };

    // Only include organizationId and technicalJobCategoryId if they are provided
    if (organizationId) {
      requestBody.organizationId = organizationId;
    }
    if (technicalJobCategoryId) {
      requestBody.technicalJobCategoryId = technicalJobCategoryId;
    }

    const res = await axios.post(
      `${process.env.BACK_END}/accounts/register`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error adding user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    if (error.response?.status === 409) {
      return {
        error: "Conflict",
        message: errorMessageFromAxios(
          error.response?.data,
          "This user already exists.",
        ),
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message: errorMessageFromAxios(
          error.response?.data,
          "Server error occurred. Please try again later.",
        ),
      };
    }

    return {
      error: "Failed to add user",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

const getUsers = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END}/accounts/getallusers`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error getting users:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    return {
      error: "Failed to get users",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

const getUserById = async (id: string) => {
  try {
    if (id === "new") {
      return null;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/accounts/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      withCredentials: true,
    });

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error getting user by id:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: errorMessageFromAxios(error.response?.data, "User not found."),
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message: errorMessageFromAxios(
          error.response?.data,
          "Server error occurred. Please try again later.",
        ),
      };
    }

    return {
      error: "Failed to get user",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

const updateUserById = async (data: any, identityAttachmentArg?: File | null) => {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    return {
      error: "Unauthorized",
      message: "No access token found. Please login again.",
    };
  }

  const apiBase = process.env.BACK_END ?? process.env.BACK_END_DEV ?? "";
  if (!apiBase) {
    return {
      error: "Configuration",
      message: "عنوان الخادم غير مهيأ (BACK_END).",
    };
  }

  return runAccountUpdatePut({
    apiBase,
    accessToken,
    data,
    identityAttachmentArg: identityAttachmentArg ?? undefined,
  });
};

const deleteUserById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/accounts/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error deleting user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: errorMessageFromAxios(error.response?.data, "User not found."),
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message: errorMessageFromAxios(
          error.response?.data,
          "Server error occurred. Please try again later.",
        ),
      };
    }

    return {
      error: "Failed to delete user",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

const softDeleteUserById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/accounts/softdelete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        withCredentials: true,
      },
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error soft deleting user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message: errorMessageFromAxios(
          error.response?.data,
          "Authentication failed. Please login again.",
        ),
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: errorMessageFromAxios(error.response?.data, "User not found."),
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message: errorMessageFromAxios(
          error.response?.data,
          "Server error occurred. Please try again later.",
        ),
      };
    }

    return {
      error: "Failed to soft delete user",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

export {
  getUserById,
  getUsers,
  addUser,
  updateUserById,
  deleteUserById,
  softDeleteUserById,
};
