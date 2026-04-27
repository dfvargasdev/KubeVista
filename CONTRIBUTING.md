# Contribuir a Lens Alternativa

¡Gracias por tu interés en contribuir! Aquí están las guías para ayudarte a empezar.

## Código de Conducta

Por favor lee nuestro código de conducta para entender qué comportamiento se espera.

## ¿Cómo Contribuir?

### Reportar Bugs

Si encuentras un bug:

1. **Verifica** que el bug no haya sido reportado
2. **Describe** con detalle:
   - Título claro y descriptivo
   - Descripción exacta del problema
   - Pasos para reproducir
   - Comportamiento esperado
   - Comportamiento actual
   - Screenshots si aplica
   - Tu entorno (OS, Node.js version, etc.)

Formato de template:

```markdown
**Descripción del Bug:**
Breve descripción del bug.

**Pasos para reproducir:**
1. ...
2. ...
3. ...

**Comportamiento esperado:**
Lo que debería pasar.

**Comportamiento actual:**
Lo que está pasando.

**Environment:**
- OS: [ej: Windows 10]
- Node: v16.0.0
- npm: 7.0.0
```

### Sugerir Mejoras

1. Usa un título descriptivo
2. Proporciona descripción detallada
3. Lista ejemplos específicos
4. Describe el comportamiento actual y esperado

### Pull Requests

1. **Fork** el repositorio
2. **Crea una rama** para tu feature:
   ```bash
   git checkout -b feature/nombre-descriptivo
   ```

3. **Commits claros**:
   ```bash
   git commit -m "Agregó nueva feature X"
   ```

4. **Push** a tu fork:
   ```bash
   git push origin feature/nombre-descriptivo
   ```

5. **Abre un PR** con descripción clara

## Guías de Desarrollo

### Setup Local

```bash
git clone https://github.com/tu-usuario/lens-alternativa.git
cd lens-alternativa
npm install
npm run dev
```

### Estándares de Código

- **TypeScript**: Usa tipos estrictos (`strict: true`)
- **React**: Usa functional components y hooks
- **Naming**: camelCase para variables, PascalCase para componentes
- **Comments**: Documenta código complejo

Ejemplo:

```typescript
// ❌ Malo
const c = async (n: string, p: string) => {
  const r = await api.getPods(n, p);
  return r;
}

// ✅ Bueno
const loadPods = async (namespace: string, clusterName: string) => {
  const pods = await window.api.getPods(namespace, clusterName);
  return pods;
}
```

### Estructura de Componentes

```typescript
import React, { useEffect, useState } from "react";
import { useClusterStore } from "@store/clusterStore";
import { FiIcon } from "react-icons/fi";

interface ComponentProps {
  // Props aquí
}

/**
 * Descripción del componente
 * @param props - Props
 * @returns Componente renderizado
 */
export const MyComponent: React.FC<ComponentProps> = (props) => {
  const { state } = useClusterStore();
  const [local, setLocal] = useState(false);

  useEffect(() => {
    // Setup
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
};
```

### Testing

```bash
# Ejecutar tests
npm test

# Con coverage
npm test -- --coverage
```

Escribe tests para:
- Servicios de Kubernetes
- Store de Zustand
- Componentes principales

### Linting

```bash
# Check
npm run lint

# Fix
npm run lint -- --fix
```

## Área de Enfoque

Areas donde necesitamos ayuda:

1. **Features**
   - [ ] Historial de cambios
   - [ ] Filtrado avanzado
   - [ ] Gráficos de recursos
   - [ ] Tema oscuro

2. **Bugs**
   - Revisar issues etiquetados como "bug"

3. **Documentation**
   - Mejorar README
   - Agregar ejemplos
   - Traduciones

4. **Tests**
   - Aumentar cobertura
   - Tests de integración

## Proceso de Review

1. Asignamos reviewers automáticamente
2. Revisión de código
3. Feedback y cambios si es necesario
4. Aprobación y merge

## Merge Criteria

- ✅ Tests pasan
- ✅ Código sigue estándares
- ✅ Documentación actualizada
- ✅ No hay breaking changes sin justificación
- ✅ Aprobado por al menos 1 reviewer

## Licencia

Al contribuir, aceptas que tu código será bajo licencia MIT.

## Contacto

- GitHub Issues: Bugs y features
- Discussions: Preguntas generales
- Email: contact@lens-alternativa.dev

¡Gracias por contribuir! 🎉
