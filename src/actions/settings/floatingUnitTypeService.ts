"use server";

import axios from "axios";
import { getAccessToken } from "@/lib/token-helper";

const addFloatingUnitType = async (data: {
  code: string;
  nameAr: string;
  nameEn: string;
  unitCategory: string;
}) => {
  try {
    const { code, nameAr, unitCategory, nameEn } = data;

    if (!nameAr || !unitCategory) {
      return {
        error: "Validation Error",
        message: "Name and unit category are required.",
      };
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.post(
      `${process.env.BACK_END}/unittypes/add`,
      {
        code,
        nameAr,
        nameEn,
        unitCategory,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return res.data;
  } catch (error: unknown) {
    console.error("Error adding floating unit type:", error);
    const err = error as {
      response?: {
        status?: number;
        data?: { message?: string; error?: string };
      };
      message?: string;
    };

    if (err.response?.status === 400) {
      return {
        error: "Bad Request",
        message:
          err.response?.data?.message ||
          err.response?.data?.error ||
          "Invalid data provided. Please check your input and try again.",
      };
    }
    if (err.response?.status === 401) {
      return {
        error: "Unauthorized",
        message:
          err.response?.data?.message ||
          "Authentication failed. Please login again.",
      };
    }
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message ||
          "This floating unit type already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          err.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }
    return {
      error: "Failed to add floating unit type",
      message:
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getFloatingUnitTypes = async () => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.get(`${process.env.BACK_END}/unittypes/getall`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });
    return res.data;
  } catch (error: unknown) {
    console.error("Error getting floating unit types:", error);
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
      error: "Failed to get floating unit types",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const getFloatingUnitTypeById = async (id: string) => {
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

    const res = await axios.get(`${process.env.BACK_END}/unittypes/get/${id}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        withCredentials: true,
      },
    });

    return res.data;
  } catch (error: unknown) {
    console.error("Error getting floating unit type by id:", error);
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
      error: "Failed to get floating unit type",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const updateFloatingUnitTypeById = async (data: {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  unitCategory: string;
}) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.put(
      `${process.env.BACK_END}/unittypes/update`,
      data,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );

    return res.data;
  } catch (error: unknown) {
    console.error("Error updating floating unit type:", error);
    const err = error as {
      response?: {
        status?: number;
        data?: { message?: string };
      };
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
    if (err.response?.status === 409) {
      return {
        error: "Conflict",
        message:
          err.response?.data?.message ||
          "This floating unit type already exists.",
      };
    }
    if (err.response?.status === 500) {
      return {
        error: "Server Error",
        message:
          err.response?.data?.message ||
          "Server error occurred. Please try again later.",
      };
    }
    return {
      error: "Failed to update floating unit type",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const deleteFloatingUnitTypeById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/unittypes/delete/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    console.error("Error deleting floating unit type:", error);
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
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message: err.response?.data?.message || "Floating unit type not found.",
      };
    }
    return {
      error: "Failed to delete floating unit type",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

const softDeleteFloatingUnitTypeById = async (id: string) => {
  try {
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const res = await axios.delete(
      `${process.env.BACK_END}/unittypes/deleteSoft/${id}`,
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          withCredentials: true,
        },
      },
    );
    return res.data;
  } catch (error: unknown) {
    console.error("Error soft deleting floating unit type:", error);
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
    if (err.response?.status === 404) {
      return {
        error: "Not Found",
        message: err.response?.data?.message || "Floating unit type not found.",
      };
    }
    return {
      error: "Failed to soft delete floating unit type",
      message:
        err.response?.data?.message ||
        err.message ||
        "An unexpected error occurred",
    };
  }
};

export {
  addFloatingUnitType,
  getFloatingUnitTypes,
  getFloatingUnitTypeById,
  updateFloatingUnitTypeById,
  deleteFloatingUnitTypeById,
  softDeleteFloatingUnitTypeById,
};
