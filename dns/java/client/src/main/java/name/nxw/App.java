package name.nxw;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.HelpFormatter;
import org.apache.commons.cli.DefaultParser;
import org.xbill.DNS.SimpleResolver;
import org.xbill.DNS.Record;
import org.xbill.DNS.Type;
import org.xbill.DNS.Lookup;
import org.xbill.DNS.ARecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class App {
    private static final Logger logger = LoggerFactory.getLogger(App.class);

    public static void main(String[] args) {
        Options options = new Options();
        options.addOption("h", "hostname", true, "Hostname to resolve");
        options.addOption("d", "dns-server", true, "Custom DNS server");
        options.addOption("l", "lib", false, "Use dnsjava library");

        CommandLineParser parser = new DefaultParser();
        HelpFormatter formatter = new HelpFormatter();

        String hostname = "baidu.com";
        String dnsServer = "127.0.0.1";
        boolean useDnsjavaLib = false;

        try {
            CommandLine cmd = parser.parse(options, args);
            String _hostname = cmd.getOptionValue("hostname");
            if (_hostname != null) {
                hostname = _hostname;
            }
            String _dnsServer = cmd.getOptionValue("dns-server");
            if (_dnsServer != null) {
                dnsServer = _dnsServer;
            }
            if (cmd.hasOption("lib")) {
                useDnsjavaLib = true;
            }
        } catch (ParseException e) {
            System.err.println("Error on parsing options: " + e.getMessage());
            formatter.printHelp("CustomDNSWithCLI", options);
        }

        try {
            String[] addresses;
            if (useDnsjavaLib) {
                addresses = resolveHostnameUsingDnsjava(hostname, dnsServer);
            } else {
                addresses = resolveHostname(hostname, dnsServer);
            }
            System.out.printf("DNS Server\t%s\n", dnsServer);
            System.out.printf("\n");
            System.out.printf("Host\t\tAddress\n");
            System.out.printf("%s\t%s\n", hostname, Arrays.toString(addresses));
        } catch (IOException e) {
            System.err.println("Error resolving hostname: " + e.getMessage());
        }
    }

    private static String[] resolveHostname(String hostname, String dnsServer) throws IOException {
        logger.info("Using system DNS settings.");
        InetAddress inetAddress = InetAddress.getByName("baidu.com");
        return new String[] { inetAddress.getHostAddress() };
    }

    private static String[] resolveHostnameUsingDnsjava(String hostname, String dnsServer) throws IOException {
        SimpleResolver resolver = new SimpleResolver(dnsServer);
        Lookup lookup = new Lookup(hostname, Type.A);
        lookup.setResolver(resolver);
        Record[] records = lookup.run();
        if (records == null) {
            throw new UnknownHostException ("Hostname not found");
        }
        String[] addresses = Arrays.stream(records).map(record -> {
            ARecord aRecord = (ARecord) record;
            return aRecord.getAddress().getHostAddress();
        }).toArray(String[]::new);
        return addresses;
    }
}
