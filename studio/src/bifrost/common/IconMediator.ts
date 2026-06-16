import type { IconComponent } from '@evil/bifrost_fw_sdk';

/**
 * Icons can be saved under an id and are then available to all parts of Bifrost.
 *
 * When registering icons, you can provide the DOM node representing the icon or give an alias:
 *
 *    bifrost.icons.registerIcons({
 *      'my-plugin/highfive/button': 'ph-fill ph-star',
 *      'my-plugin/highfive/button-alt': (
 *        <svg>
 *          <path
 *            fill="currentColor"
 *            d="M16,12A2,2 0 0,1 18,10A2,2 0 0,1 20,12A2,2 0 0,1 18,14A2,2 0 0,1 16,12M10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12M4,12A2,2 0 0,1 6,10A2,2 0 0,1 8,12A2,2 0 0,1 6,14A2,2 0 0,1 4,12Z"
 *          />
 *        </svg>
 *      )
 *    })
 *
 * When using the icons in a component, import the `Icon` component directly from the SDK:
 *
 *    import { Icon } from '@evil/bifrost_fw_sdk';
 *
 *    // my-plugin/src/HighFiveButton.tsx
 *    function HighFiveButton(props: any) {
 *      return <button>
 *        {props.username}
 *        <Icon id="my-plugin/highfive/button" />
 *      </button>;
 *    }
 *
 * By abstracting icons from an icon framework, icons are not bound to a specific vendor (currently Phosphor Icons).
 * This way, each plugin can use Bifrost's icons and these are always looking the same, even if Bifrost's icons for
 * certain intents change over time and plugins can bring their own icons into the system.
 *
 * Additional advantages, that we want to explore in the future: Theming for icons, being able to statically analyse
 * and pre-bundle icons in the future.
 */
export class IconMediator {
  private iconComponent: IconComponent | null = null;

  /**
   * Registers the given `mapOfIcons`.
   *
   * These can then be used with the component returned by `getComponent()`.
   *
   * Example:
   *
   *    bifrost.icons.registerIcons({'my-plugin/highfive/button': 'ph-fill ph-star'})
   */
  registerIcons(mapOfIcons: any): void {
    Object.keys(mapOfIcons).forEach((id: string) => {
      this.iconComponent.registerIcon(id, mapOfIcons[id]);
    });
  }

  /**
   * Internal: Used by Bifrost's initializer. Sets the used `Icon` instance.
   */
  setComponent(iconComponent: any): any {
    if (this.iconComponent != null) {
      throw new Error('`iconComponent` is already set.');
    }

    this.iconComponent = iconComponent;
  }
}
