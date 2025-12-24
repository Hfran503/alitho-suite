package com.pace2020.epace.sdk.util;

import java.util.List;

import com.pace2020.appbox.services.rpc.ArrayOfXPathDataSort;
import com.pace2020.appbox.services.rpc.XPathDataSort;

public class FindObjectsClient extends SecuredWSDLClient
{
    public List<String> find( final String objectType, final String xpathString )
    {
        return findAndSort( objectType, xpathString, null );
    }

    public List<String> findAndSort( final String objectType, final String xpathString, final String sortString )
    {
        return findSortAndLimit( objectType, xpathString, sortString, null, null );
    }

    public List<String> findSortAndLimit( final String objectType, final String xpathString, final String sortString,
                                          final Integer offset, final Integer limit )
    {
        if( null == objectType )
        {
            return null;
        }

        final String xpath = null != xpathString ? xpathString : "";

        if( null == sortString || sortString.trim().length() == 0 )
        {
            return getFindObjectsPortType().find( objectType, xpath ).getString();
        }
        else
        {
            final ArrayOfXPathDataSort sortArray = createSortArray( sortString );

            if( null != offset && offset >= 0 && null != limit && limit > 0 )
            {
                return getFindObjectsPortType().findSortAndLimit( objectType, xpath, sortArray, offset, limit )
                    .getString();
            }
            else
            {
                return getFindObjectsPortType().findAndSort( objectType, xpath, sortArray ).getString();
            }
        }
    }

    private ArrayOfXPathDataSort createSortArray( final String sortString )
    {
        final ArrayOfXPathDataSort sortArray = new ArrayOfXPathDataSort();

        final String[] sortPairs = sortString.split( "," );
        for( String sortPair : sortPairs )
        {
            final String[] sortParams = sortPair.split( "=" );
            final String sortField = sortParams.length > 0 ? sortParams[0] : null;
            final String sortFieldSortOrder = sortParams.length > 1 ? sortParams[1] : null;

            if( null != sortField )
            {
                final XPathDataSort sort = new XPathDataSort();
                sort.setXpath( sortField );

                sort.setDescending( false );
                if( "desc".equalsIgnoreCase( sortFieldSortOrder ) || "false".equalsIgnoreCase( sortFieldSortOrder ) )
                {
                    sort.setDescending( true );
                }

                sortArray.getXPathDataSort().add( sort );
            }
        }
        return sortArray;
    }

    public static void main( final String[] args ) throws Exception
    {
        if( args.length > 1 )
        {
            final FindObjectsClient client = new FindObjectsClient();

            List<String> keys = client.findSortAndLimit( args[0], args[1],
                                                         args.length > 2 ? args[2] : null,
                                                         args.length > 3 ? new Integer( args[3] ) : null,
                                                         args.length > 4 ? new Integer( args[4] ) : null );

            System.out.println( keys.size() + " " + args[0] + " found using filter " + args[1] );
            System.out.println( keys );
        }
    }
}
