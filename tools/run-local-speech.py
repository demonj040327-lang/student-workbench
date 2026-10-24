"""Launch the isolated local ASR service using macOS system certificate trust."""
import truststore
truststore.inject_into_ssl()
from whisperlivekit.cli import main
if __name__ == '__main__':
    main()
