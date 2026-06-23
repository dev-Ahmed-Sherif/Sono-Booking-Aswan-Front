import { PermissionsRolesDetailRedirect } from "@/components/permissions/permissions-roles-detail-redirect";

type RoleProps = {
  params: {
    roleId: string;
  };
};

const RolePage = async ({ params: _params }: RoleProps) => {
  return <PermissionsRolesDetailRedirect />;
};

export default RolePage;
