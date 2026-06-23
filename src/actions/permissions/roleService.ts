"use server";

import axios from "@/lib/axios-auth";
import {
  errorMessageFromAxios,
  getApiBaseUrl,
  unwrapApiList,
} from "@/lib/api-response";
import { toPlainSerializable } from "@/lib/to-plain-serializable";
import { getAccessToken } from "@/lib/token-helper";

function authHeaders(accessToken: string) {
  return {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    withCredentials: true as const,
  };
}

const addRole = async (data: any) => {
  try {
    const { nameAr, nameEn } = data;
    const accessToken = await getAccessToken();

    if (!accessToken) {
      return {
        error: "Unauthorized",
        message: "No access token found. Please login again.",
      };
    }

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.post(
      `${apiBase}/roles/add`,
      { nameAr, nameEn },
      authHeaders(accessToken),
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error adding role:", error);

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
          "This role already exists.",
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
      error: "Failed to add role",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
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

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.get(
      `${apiBase}/roles/getall`,
      authHeaders(accessToken),
    );

    const payload = toPlainSerializable(res.data);
    const list = unwrapApiList(payload);

    return { data: list };
  } catch (error: any) {
    console.error("Error getting roles:", error);

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
      error: "Failed to get roles",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
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

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.get(
      `${apiBase}/roles/get/${id}`,
      authHeaders(accessToken),
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error getting role by id:", error);

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
        message: errorMessageFromAxios(error.response?.data, "Role not found."),
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
      error: "Failed to get role",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
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

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.put(
      `${apiBase}/roles/update`,
      { id, nameAr, nameEn },
      authHeaders(accessToken),
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error updating role:", error);

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
          "This role already exists.",
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
      error: "Failed to update role",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
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

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.delete(
      `${apiBase}/roles/delete/${id}`,
      authHeaders(accessToken),
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error deleting role:", error);

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
        message: errorMessageFromAxios(error.response?.data, "Role not found."),
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
      error: "Failed to delete role",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
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

    const apiBase = getApiBaseUrl();
    if (!apiBase) {
      return {
        error: "Configuration",
        message: "عنوان الخادم غير مهيأ (BACK_END).",
      };
    }

    const res = await axios.delete(
      `${apiBase}/roles/softdelete/${id}`,
      authHeaders(accessToken),
    );

    return toPlainSerializable(res.data);
  } catch (error: any) {
    console.error("Error soft deleting role:", error);

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
        message: errorMessageFromAxios(error.response?.data, "Role not found."),
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
      error: "Failed to soft delete role",
      message: errorMessageFromAxios(
        error.response?.data,
        error?.message || "An unexpected error occurred",
      ),
    };
  }
};

export {
  addRole,
  getRoles,
  getRoleById,
  updateRoleById,
  deleteRoleById,
  softDeleteRoleById,
};
