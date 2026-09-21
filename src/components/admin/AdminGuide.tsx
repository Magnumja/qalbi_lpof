/** Ajuda de operação junto das ferramentas, sem depender de documentação técnica. */
export default function AdminGuide() {
  return (
    <section className="admin-guide">
      <h2>Tu rutina, paso a paso</h2>
      <p>
        Empieza por los mensajes nuevos y los plazos. Después revisa los
        encargos que necesitan presupuesto.
      </p>
      <details open>
        <summary>1. Atender pedidos y conversaciones</summary>
        <p>
          Usa los indicadores para filtrar pendientes. Busca por número, nombre
          o correo electrónico y abre el pedido para ver sus piezas, dirección y
          conversación.
        </p>
        <p>
          Responde desde el pedido: así todos los detalles quedan en su
          historial. Actualiza la lista para consultar los cambios más
          recientes.
        </p>
      </details>
      <details>
        <summary>2. Presupuestar y organizar la producción</summary>
        <p>
          En un encargo personalizado, acuerda los detalles con el cliente antes
          de indicar precio y fecha. Revisa el estado del pago antes de empezar.
        </p>
        <p>
          Ordena por fecha de entrega para organizar el trabajo. Actualiza el
          estado y el seguimiento de envío desde cada pedido. Un plazo sin
          confirmar aparece como «Por confirmar».
        </p>
      </details>
      <details>
        <summary>3. Publicar una pieza en la tienda</summary>
        <p>
          En Productos, elige Nueva pieza, sube una foto y completa nombre,
          descripción, categoría, precio y preparación. Para piezas listas para
          enviar, indica las unidades disponibles.
        </p>
        <p>
          Marca «Publicar en la tienda» y guarda. Desmarca esa opción para
          conservar la pieza como borrador. Editar un producto no cambia los
          importes de pedidos ya creados.
        </p>
      </details>
      <details>
        <summary>
          4. Cambiar las fotos y los destacados de la página inicial
        </summary>
        <p>
          En Página inicial puedes cambiar las fotos principales y editar,
          ordenar u ocultar las creaciones. Revisa la vista previa antes de
          publicar.
        </p>
        <p>
          Los destacados cuentan la historia del atelier; los productos de la
          tienda tienen su propio precio y disponibilidad.
        </p>
      </details>
      <details>
        <summary>5. Ayudar a un cliente que no consigue entrar</summary>
        <p>
          Abre su pedido y usa las herramientas de acceso disponibles. Comparte
          un enlace de acceso únicamente con el titular: permite entrar en su
          cuenta y tiene una validez limitada.
        </p>
        <p>
          No pidas datos de tarjeta ni contraseñas por la conversación. El pago
          se completa en la página segura del proveedor.
        </p>
      </details>
    </section>
  );
}
