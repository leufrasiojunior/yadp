// Importa o resolver do Zod para o React Hook Form
import { zodResolver } from "@hookform/resolvers/zod";
// Importa o hook de traduções do next-intl
import { useTranslations } from "next-intl";
// Importa os hooks useForm e useFieldArray do React Hook Form
import { useForm, useFieldArray } from "react-hook-form";
// Importa o Zod para validação de esquemas
import { z } from "zod";

// ❗ Função para construir o esquema com validações personalizadas (superRefine)
// Esta função é exportada para que seus tipos possam ser inferidos externamente.
// O 't' é uma função de tradução, usada para mensagens de erro localizadas.
export function createSetupFormSchema(t: (key: string) => string) {
  // Esquema base para uma única entrada Pi-hole
  // Definido dentro desta função para ter acesso a 't'
  const PiholeSchema = z.object({
    url: z.url(t("step2_pihole_url_error")), // Valida se a URL é válida, usando 't'
    password: z.string().optional(), // A senha é opcional
  });

  // Esquema base para a configuração geral do aplicativo
  // Definido dentro desta função para ter acesso a 't'
  const SetupSchemaBase = z.object({
    samePassword: z.boolean().default(true), // Indica se todos os Pi-holes usam a mesma senha
    piholes: z.array(PiholeSchema).min(1, t("pihole_min_error")).max(5, t("pihole_max_error")), // Um array de Pi-holes, com limite de 1 a 5
    primaryIndex: z.number().int().default(0), // Índice do Pi-hole primário
    usePiholeAuth: z.boolean().default(true), // Indica se a autenticação do Pi-hole será usada
    yapdPassword: z.string().optional().default(""), // Senha para o YAPD (Yet Another Pi-hole Dashboard)
    themePreset: z.string().default("default"), // Tema de cores
    themeMode: z.string().default("dark"), // Modo do tema (claro ou escuro)
    sidebarVariant: z.string().default("sidebar"), // Variante da barra lateral
    sidebarCollapsible: z.string().default("icon"), // Comportamento de recolhimento da barra lateral
    contentLayout: z.string().default("full-width"), // Layout do conteúdo
  });

  // Usamos superRefine para adicionar validações personalizadas que dependem de vários campos
  return SetupSchemaBase.superRefine((data, ctx) => {
    // Itera sobre cada Pi-hole na lista
    data.piholes.forEach((item, idx) => {
      // Se 'samePassword' não for true OU se for o primeiro Pi-hole (índice 0)
      if (!data.samePassword || idx === 0) {
        // Verifica se a senha do Pi-hole está vazia ou contém apenas espaços em branco
        if (!item.password || item.password.trim().length === 0) {
          ctx.addIssue({
            code: "custom", // Usamos a string literal "custom"
            message: t("step2_password_error"), // Mensagem de erro traduzida
            path: ["piholes", idx, "password"], // Caminho do campo onde o erro ocorreu
          });
        }
      }
    });

    // Validação para o índice primário
    if (data.primaryIndex < 0 || data.primaryIndex >= data.piholes.length) {
      ctx.addIssue({
        code: "custom", // Usamos a string literal "custom"
        message: t("step2_primary_error"), // Mensagem de erro traduzida
        path: ["primaryIndex"], // Caminho do campo onde o erro ocorreu
      });
    }

    // Validação para a senha do YAPD se a autenticação do Pi-hole não for usada
    if (!data.usePiholeAuth) {
      if (!data.yapdPassword || data.yapdPassword.trim().length === 0) {
        ctx.addIssue({
          code: "custom", // Usamos a string literal "custom"
          message: t("step3_password_error"), // Mensagem de erro traduzida
          path: ["yapdPassword"], // Caminho do campo onde o erro ocorreu
        });
      }
    }
  });
}

// ⛑ Tipos separados corretamente para entrada e saída do formulário
// Estes tipos são inferidos do retorno de 'createSetupFormSchema' e exportados.
export type DummyT = (key: string) => string;
export type SetupFormSchema = ReturnType<typeof createSetupFormSchema>;
export type SetupFormInput = z.input<SetupFormSchema>;
export type SetupFormOutput = z.infer<SetupFormSchema>;

// Hook personalizado para gerenciar o formulário de configuração
export function useSetupForm() {
  const t = useTranslations("Setup");

  // Constrói o esquema de validação usando a função de tradução
  const schema = createSetupFormSchema(t);

  // Inicializa o hook useForm do React Hook Form
  const form = useForm<SetupFormInput, unknown, SetupFormOutput>({
    resolver: zodResolver(schema),
    defaultValues: {
      // Define os valores padrão do formulário
      samePassword: true,
      piholes: [{ url: "", password: "" }],
      primaryIndex: 0,
      usePiholeAuth: true,
      yapdPassword: "",
      themePreset: "default",
      themeMode: "dark",
      sidebarVariant: "sidebar",
      sidebarCollapsible: "icon",
      contentLayout: "full-width",
    },
  });

  // Hook useFieldArray para gerenciar dinamicamente o array de Pi-holes
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "piholes",
  });

  return { form, fields, append, remove };
}
