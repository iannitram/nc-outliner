<?php
/** @var array $_ */
script('nc_outliner', 'nc_outliner-main');
style('nc_outliner', 'nc_outliner-style');
?>
<div id="nc_outliner" data-crash-log="<?php p($_['crashLog']); ?>" data-app-version="<?php p($_['appVersion']); ?>" data-nc-version="<?php p($_['ncVersion']); ?>"></div>
