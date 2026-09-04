/** @type {import('next').NextConfig} */
const nextConfig = {
  // 编辑器包以源码形式分发，由 Next 转译
  transpilePackages: ["@magicbook/editor"],
  // §13 任务模板：prompts/*.md 以纯文本打进客户端 bundle
  webpack: (config) => {
    config.module.rules.push({ test: /\.md$/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
