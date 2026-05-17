/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // !! ADVERTENCIA !!
    // Peligrosamente permite que la compilación de producción finalice con éxito
    // incluso si tu proyecto tiene errores de TypeScript.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignorar errores de ESLint durante la compilación
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: true,
  },
  outputFileTracingIncludes: {
    '/*': ['./prisma/dev.db'],
  }
}

module.exports = nextConfig
