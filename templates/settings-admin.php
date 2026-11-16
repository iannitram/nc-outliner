<?php
declare(strict_types=1);
/** @var array $_ */
?>
<form class="section" action="<?php p($_['action']); ?>" method="post">
	<h2>Outliner</h2>
	<input type="hidden" name="requesttoken" value="<?php p(\OCP\Util::callRegister()); ?>">
	<p><label for="bug-drop-base">Bug drop base URL</label></p>
	<input id="bug-drop-base" type="url" name="bug_drop_base" value="<?php p($_['base']); ?>">
	<p><label for="bug-drop-token">Bug drop token (<?php p($_['tokenSet'] ? 'set' : 'not set'); ?>)</label></p>
	<input id="bug-drop-token" type="password" name="bug_drop_token" value="" autocomplete="new-password">
	<p>Leave the token blank to keep it.</p>
	<p><label><input type="checkbox" name="clearToken" value="1"> Clear saved token</label></p>
	<button type="submit">Save</button>
</form>
