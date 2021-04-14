import wget
import logging
from flask import send_file
from datetime import date, timedelta


def download_fex_report(request):
    try:
        yesterday = date.today() - timedelta(days=1)
        filename = "SE{}D.csv".format(yesterday.strftime('%m%d%y'))
        cf_path = "/tmp/{}".format(filename)
        if request.method == "GET":
            logging.info("Fetching file:{}".format(filename))
            wget.download(
                'ftp://<USERNAME>:<PASSWORD>@ftp.fex3pl.com/{}'.format(filename),
                cf_path
            )
            return send_file(
                cf_path,
                mimetype="text/csv",
                attachment_filename=filename,
                as_attachment=True
            )
    except Exception as e:
        logging.error(e)
        return e
