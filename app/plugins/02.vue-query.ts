import { MutationCache, QueryCache, QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { ApiProblem, isRetryableRead } from '~/shared/api/problem'
import { useSessionStore } from '~/shared/auth/session.store'

export default defineNuxtPlugin({
  name: 'vue-query',
  dependsOn: ['api'],
  setup(nuxtApp) {
    const session = useSessionStore()

    // Reacciones comunes a errores de la API (ARCHITECTURE_PROPOSAL §4).
    const onError = (error: unknown) => {
      if (!(error instanceof ApiProblem)) return
      if (error.type === 'password-change-required') {
        session.loadAccount().catch(() => undefined)
        navigateTo('/cambiar-contrasena')
      } else if (error.type === 'forbidden') {
        // Los roles pudieron cambiar: se vuelven a leer los permisos.
        session.loadAccount().catch(() => undefined)
      }
    }

    const queryClient = new QueryClient({
      queryCache: new QueryCache({ onError }),
      mutationCache: new MutationCache({ onError }),
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: (failureCount, error) =>
            failureCount < 1 && error instanceof ApiProblem && isRetryableRead(error),
          refetchOnWindowFocus: true,
        },
        mutations: { retry: false },
      },
    })

    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
    // Al cerrar sesión no deben quedar datos de otro usuario en cache.
    session.$onAction(({ name, after }) => {
      if (name === 'logout' || name === 'clearLocal' || name === 'expireFromOtherTab') {
        after(() => queryClient.clear())
      }
    })
  },
})
