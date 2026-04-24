"use client";

import { useParams, useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { Copy, Edit, MoreHorizontal, Trash } from "lucide-react";

import { ComputerIssueColumn } from "@/components/report/columns";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

import AlertModal from "@/components/modals/alert-modal";

import useToggleState from "@/hooks/use-toggle-state";

type CellActionProps = {
  data: ComputerIssueColumn;
};

const CellAction = ({ data }: CellActionProps) => {
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();

  const [loading, toggleLoading] = useToggleState(false);
  const [open, toggleOpen] = useToggleState(false);

  const onCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    toast({
      title: "Copied!",
      description: "Billboard Id copied to your clipboard.",
    });
  };

  const onDelete = async () => {
    try {
      toggleLoading();

      await axios.delete(`/api/${params.storeId}/sizes/${data.id}`);

      // Success - show toast
      toast({
        description: "👍👍 تم الحذف بنجاح",
        duration: 2000,
      });

      // Close modal immediately
      toggleOpen();
      toggleLoading();

      // Refresh the page to ensure app is interactive
      setTimeout(() => {
        router.refresh();
        // Use window.location.reload() to fully refresh and make app interactive
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }, 1000);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        variant: "destructive",
        title: "خطأ في الحذف",
        description: err.message || "❌ لم يتم الحذف",
        duration: 3000,
      });
      toggleLoading();
      toggleOpen();
    }
  };

  return (
    <>
      <AlertModal
        isOpen={open}
        loading={loading}
        onClose={() => toggleOpen()}
        onConfirm={onDelete}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open Menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onCopy(data.id)}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Id
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push(`/${params.storeId}/sizes/${data.id}`)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Update
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toggleOpen()}>
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export default CellAction;
