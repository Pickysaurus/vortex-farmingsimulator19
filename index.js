//Import some assets from Vortex we'll need.
const path = require('path');
const { fs, log, util } = require('vortex-api');
const { remote } = require('electron');
const app = remote.app;

const MOD_EXT = '.zip';

// Nexus Mods domain for the game. e.g. nexusmods.com/farmingsimulator19
const FS19_ID = 'farmingsimulator19';

//Steam Application ID, you can get this from https://steamdb.info/apps/
const FS19STEAMAPP_ID = '787860';
const FS19EPICAPP_ID = 'Stellula';
const FS19XBOXAPP_ID = 'FocusHomeInteractiveSA.FarmingSimulator19-Window10';

const gameData = {
    storeIds: [FS19EPICAPP_ID, FS19STEAMAPP_ID, FS19XBOXAPP_ID],
    modsPath: path.join(app.getPath('documents'), 'My Games', 'FarmingSimulator2019', 'mods')
};

function findGame() {
  return util.GameStoreHelper.findByAppId(gameData.storeIds)
      .then(game => game.gamePath);
}

async function installContent(files, destinationPath) {
    const zipFiles = files.filter(file => path.extname(file) === MOD_EXT);
    // If it's a double zip, we don't need to repack. 
    if (zipFiles.length) {
        const instructions = zipFiles.map(file => {
            return {
                type: 'copy',
                source: file,
                destination: path.basename(file)
            }
        });
        return Promise.resolve({ instructions });
    }
    // Repack the ZIP
    else {
        const szip = new util.SevenZip();
        const archiveName = path.basename(destinationPath, '.installing') + '.zip';
        const archivePath = path.join(destinationPath, archiveName);
        const rootRelPaths = await fs.readdirAsync(destinationPath);
        await szip.add(archivePath, rootRelPaths.map(relPath => path.join(destinationPath, relPath)), { raw: ['-r'] });
        // No longer using a "generateFile" instruction as fs.readFileAsync() craps out at 2GB+ files. 
        // https://github.com/Nexus-Mods/Vortex/issues/8426
        const instructions = [{
            type: 'copy',
            source: archiveName,
            destination: archiveName,
        }];
        return Promise.resolve({ instructions });
    }
}


function prepareForModding() {
    return fs.ensureDirWritableAsync(gameData.modsPath);
}

async function requiresLauncher(gamePath) {
  try {
    const xboxInstall = await util.GameStoreHelper.findByAppId([FS19XBOXAPP_ID], 'xbox');
    if (xboxInstall.gamePath.toLowerCase() === gamePath.toLowerCase()) return (
      {
        launcher: 'xbox',
        addInfo: {
          appId: FS19XBOXAPP_ID,
          parameters: [
            { appExecName: 'Game' }
          ]
        }
      }
    );
  }
  catch(err) {
    return undefined;
  }
}

async function getGameVersion(discoveryPath) {
  const versionFile = path.join(discoveryPath, 'VERSION');
  try {
      const version = await fs.readFileAsync(versionFile, { encoding: 'utf8' });
      return version.trim();
  }
  catch(err) {
      log('warn', 'Unable to determine game version for Farming Simulator 19.', err);
      return undefined;
  }
}

function testSupportedContent(files, gameId) {
  // Make sure we're able to support this mod.
  return Promise.resolve({
    supported: (gameId === FS19_ID),
    requiredFiles: [],
  });
}

function main(context) {
	//This is the main function Vortex will run when detecting the game extension. 
	context.registerGame({
		id: FS19_ID,
		name: 'Farming Simulator 19',
		mergeMods: true,
		queryPath: findGame,
		supportedTools: [],
		queryModPath: () => gameData.modsPath,
		logo: 'gameart.jpg',
		executable: () => 'FarmingSimulator2019.exe',
		requiredFiles: [
		  'FarmingSimulator2019.exe',
		],
		setup: prepareForModding,
    requiresLauncher,
    getGameVersion,
		environment: {
		  SteamAPPId: FS19STEAMAPP_ID,
		},
		details: {
		  steamAppId: FS19STEAMAPP_ID,
		  epicAppId: FS19EPICAPP_ID,
      xboxAppId: FS19XBOXAPP_ID
		},
	});
	
	context.registerInstaller('farmingsimulator-mod', 25, testSupportedContent, installContent);
	
	return true
}

module.exports = {
    default: main,
  };