// src/app/api/piholes/auth/route.ts

import https from "https";

import { NextRequest, NextResponse } from "next/server";

import axios, { AxiosError } from "axios";

// Cria um agente HTTPS que ignora a validação de certificados SSL
// Útil para Pi-holes com certificados self-signed ou inválidos
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

// Tipos para melhor tipagem
interface AuthRequest {
  url: string;
  password: string;
}

interface AuthResponse {
  sid: string;
  csrf: string;
  message: string;
}

interface ErrorResponse {
  error: string;
}

interface ErrorResult {
  message: string;
  statusCode: number;
}

interface AuthRequestBody {
  url?: string;
  password?: string;
}

/**
 * Valida os parâmetros de entrada da requisição
 * @param body - Corpo da requisição parseado
 * @returns NextResponse se inválido, null se válido
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateAuthRequest(body: any): NextResponse<ErrorResponse> | null {
  const { url, password } = body;

  if (!url || !password) {
    return NextResponse.json({ error: "URL e senha são obrigatórios" }, { status: 400 });
  }

  return null;
}

/**
 * Prepara a URL do endpoint de autenticação
 * @param url - URL base do Pi-hole
 * @returns URL limpa do endpoint de autenticação
 */
function prepareAuthEndpoint(url: string): string {
  const cleanUrl = url.replace(/\/$/, "");
  return `${cleanUrl}/api/auth`;
}

/**
 * Configura as opções para a requisição axios
 * @returns Configuração do axios
 */
function getAxiosConfig() {
  return {
    httpsAgent,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Pi-hole Dashboard Client",
    },
    timeout: 10000,
    validateStatus: (status: number) => status < 500,
  };
}

interface PiholeResponse {
  session?: {
    sid?: string;
    csrf?: string;
  };
}

/**
 * Valida a resposta do Pi-hole
 * @param data - Dados retornados pelo Pi-hole
 * @returns NextResponse se inválido, null se válido
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validatePiholeResponse(data: any): NextResponse<ErrorResponse> | null {
  if (!data?.session?.sid || !data?.session?.csrf) {
    console.error("Resposta inválida do Pi-hole:", data);
    return NextResponse.json({ error: "Credenciais inválidas ou resposta malformada" }, { status: 401 });
  }

  return null;
}

/**
 * Cria uma resposta de sucesso
 * @param sid - Session ID
 * @param csrf - CSRF token
 * @returns NextResponse com dados de autenticação
 */
function createSuccessResponse(sid: string, csrf: string): NextResponse<AuthResponse> {
  console.log("Autenticação bem-sucedida no Pi-hole");

  return NextResponse.json({
    sid,
    csrf,
    message: "Autenticação realizada com sucesso",
  });
}

/**
 * Mapeia erros do Axios para mensagens e códigos de status apropriados
 * @param err - Erro do Axios
 * @returns Objeto com mensagem e código de status
 */
function mapAxiosError(err: AxiosError): ErrorResult {
  // Mapa de códigos de erro para respostas estruturadas
  const errorMap: Record<string, ErrorResult> = {
    ENOTFOUND: {
      message: "Não foi possível conectar ao Pi-hole. Verifique a URL.",
      statusCode: 503,
    },
    ECONNREFUSED: {
      message: "Não foi possível conectar ao Pi-hole. Verifique a URL.",
      statusCode: 503,
    },
    ETIMEDOUT: {
      message: "Timeout na conexão com o Pi-hole",
      statusCode: 408,
    },
  };

  // Verifica se existe mapeamento para o código de erro
  if (err.code && errorMap[err.code]) {
    return errorMap[err.code];
  }

  // Trata erros baseados no status HTTP da resposta
  if (err.response?.status === 401) {
    return {
      message: "Senha incorreta",
      statusCode: 401,
    };
  }

  if (err.response?.status) {
    return {
      message: `Erro do Pi-hole: ${err.response.status}`,
      statusCode: err.response.status,
    };
  }

  // Erro genérico
  return {
    message: "Falha na autenticação",
    statusCode: 500,
  };
}

/**
 * Processa erros e retorna resposta apropriada
 * @param err - Erro capturado
 * @returns NextResponse com erro formatado
 */
function handleError(err: unknown): NextResponse<ErrorResponse> {
  let errorResult: ErrorResult;

  if (axios.isAxiosError(err)) {
    errorResult = mapAxiosError(err);
  } else if (err instanceof Error) {
    errorResult = {
      message: err.message,
      statusCode: 500,
    };
  } else {
    errorResult = {
      message: "Falha na autenticação",
      statusCode: 500,
    };
  }

  // Log detalhado do erro para debugging
  console.error("Erro de autenticação Pi-hole:", {
    message: errorResult.message,
    error: err instanceof Error ? err.message : err,
    stack: err instanceof Error ? err.stack : undefined,
  });

  return NextResponse.json({ error: errorResult.message }, { status: errorResult.statusCode });
}

/**
 * Executa a autenticação no Pi-hole
 * @param authEndpoint - URL do endpoint de autenticação
 * @param password - Senha para autenticação
 * @returns Dados da resposta do axios
 */
async function authenticateWithPihole(authEndpoint: string, password: string) {
  console.log(`Tentando autenticar no Pi-hole: ${authEndpoint}`);

  return await axios.post(authEndpoint, { password }, getAxiosConfig());
}

/**
 * Manipula requisições POST para autenticação no Pi-hole
 * Complexidade reduzida através da separação de responsabilidades
 * @param req - Requisição Next.js contendo URL e senha do Pi-hole
 * @returns Resposta JSON com session ID e CSRF token ou erro
 */
export async function POST(req: NextRequest) {
  try {
    // 1. Extrai e valida dados da requisição
    const body = await req.json();
    const validationError = validateAuthRequest(body);
    if (validationError) return validationError;

    const { url, password } = body as AuthRequest;

    // 2. Prepara endpoint de autenticação
    const authEndpoint = prepareAuthEndpoint(url);

    // 3. Executa autenticação
    const { data } = await authenticateWithPihole(authEndpoint, password);

    // 4. Valida resposta do Pi-hole
    const responseError = validatePiholeResponse(data);
    if (responseError) return responseError;

    // 5. Extrai dados e retorna sucesso
    const { sid, csrf } = data.session;
    return createSuccessResponse(sid, csrf);
  } catch (err) {
    // 6. Trata erros de forma centralizada
    return handleError(err);
  }
}
