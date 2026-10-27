<?php

declare(strict_types=1);

namespace OC\Hooks;

/**
 * Test-only stub of the Nextcloud core interface that nextcloud/ocp omits.
 */
interface Emitter {
	/**
	 * @param string $scope
	 * @param string $method
	 * @param callable $callback
	 */
	public function listen($scope, $method, callable $callback);

	/**
	 * @param string $scope optional
	 * @param string $method optional
	 * @param callable $callback optional
	 */
	public function removeListener($scope = null, $method = null, ?callable $callback = null);
}
