"use server";

import * as z from "zod";
import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const addRole = async (data: any) => {
  try {
    console.log("addRole:", data);
    const { nameAr, nameEn } = data;

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.post(
      `${process.env.BACK_END_DEV}/roles/add`,
      {
        nameAr: nameAr,
        nameEn: nameEn,
      },
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
    console.error("Error adding role:", error);

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
        message: error.response?.data?.message || "This role already exists.",
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
      error: "Failed to add role",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const getRoles = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END_DEV}/roles/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    console.log("res.data:", res.data);
    return res.data;
  } catch (error: any) {
    console.error("Error getting roles:", error);

    if (error.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          error.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }

    return {
      error: "Failed to get roles",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const getRoleById = async (id: string) => {
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

    const res = await axios.get(`${process.env.BACK_END_DEV}/roles/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: any) {
    console.error("Error getting role by id:", error);

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
        message: error.response?.data?.message || "Role not found.",
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
      error: "Failed to get role",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const updateRoleById = async (data: any) => {
  try {
    const { nameEn, nameAr, id } = data;

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.put(
      `${process.env.BACK_END_DEV}/roles/update`,
      {
        id: id,
        nameAr: nameAr,
        nameEn: nameEn,
      },
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
    console.error("Error updating role:", error);

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
        message: error.response?.data?.message || "This role already exists.",
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
      error: "Failed to update role",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteRoleById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END_DEV}/roles/delete/${id}`,
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
    console.error("Error deleting role:", error);

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
        message: error.response?.data?.message || "Role not found.",
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
      error: "Failed to delete role",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteRoleById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END_DEV}/roles/softdelete/${id}`,
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
    console.error("Error soft deleting role:", error);

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
        message: error.response?.data?.message || "Role not found.",
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
      error: "Failed to soft delete role",
      message:
        error.response?.data?.message ||
        error.message ||
        "An unexpected error occurred",
    };
  }
};

export { addRole, getRoles, getRoleById, updateRoleById, deleteRoleById, softDeleteRoleById };
