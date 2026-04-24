"use server";

import * as z from "zod";
import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

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
      `${process.env.BACK_END_DEV}/accounts/register`,
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error adding user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 409) {
      return {
        error: "Conflict",
        message: error.response?.data?.message || "This user already exists.",
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          error.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }

    return {
      error: "Failed to add user",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
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
      `${process.env.BACK_END_DEV}/accounts/getallusers`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error getting users:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get users",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const getUserById = async (id: string) => {
  try {
    if (id === "new") {
      return undefined;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(
      `${process.env.BACK_END_DEV}/accounts/get/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error getting user by id:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "User not found.",
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          error.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }

    return {
      error: "Failed to get user",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const updateUserById = async (data: any) => {
  console.log("update Data", data);
  try {
    const {
      id,
      userName,
      email,
      oldPassword,
      newPassword,
      confirmPassword,
      roleId,
      organizationId,
      technicalJobCategory,
    } = data;

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const updateData: any = {
      id: id,
      userName: userName,
      email: email,
      oldPassword: oldPassword,
      newPassword: newPassword,
      confirmPassword: confirmPassword,
      roleId: roleId,
    };

    // Only include organizationId and technicalJobCategory if they are provided
    if (organizationId) {
      updateData.organizationId = organizationId;
    }
    if (technicalJobCategory) {
      updateData.technicalJobCategory = technicalJobCategory;
    }

    const res = await axios.put(
      `${process.env.BACK_END_DEV}/accounts/update`,
      updateData,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error updating user:", error.message);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 409) {
      return {
        error: "Conflict",
        message: error.response?.data?.message || "This user already exists.",
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          error.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }

    return {
      error: "Failed to update user",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
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
      `${process.env.BACK_END_DEV}/accounts/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error deleting user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "User not found.",
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          error.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }

    return {
      error: "Failed to delete user",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
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
      `${process.env.BACK_END_DEV}/accounts/softdelete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      }
    );

    return res.data;
  } catch (error: any) {
    console.error("Error soft deleting user:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    if (error.response?.status === 404) {
      return {
        error: "Not Found",
        message: error.response?.data?.message || "User not found.",
      };
    }

    if (error.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          error.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }

    return {
      error: "Failed to soft delete user",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

export { getUserById, getUsers, addUser, updateUserById, deleteUserById, softDeleteUserById };
