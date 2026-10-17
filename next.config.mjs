/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "pg", "unpdf", "nodemailer"],
  experimental: { serverActions: { bodySizeLimit: "12mb" } },
};
export default nextConfig;
