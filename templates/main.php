<?php
\OCP\Util::addScript('outliner', 'main');
\OCP\Util::addStyle('outliner', 'outliner');
?>
<div id="outliner-app" data-api-base="<?php p($_['apiBase']); ?>" data-webroot="<?php p($_['webroot']); ?>" data-app-js="<?php p($_['appJs']); ?>" data-uid="<?php p($_['uid']); ?>"></div>
